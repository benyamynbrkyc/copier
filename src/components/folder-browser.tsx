import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { FolderOpen, Folder, File, Copy, Loader2, ChevronRight, ChevronDown } from 'lucide-react'

interface FileItem {
  handle: FileSystemFileHandle | FileSystemDirectoryHandle
  name: string
  type: 'file' | 'directory'
  selected: boolean
  content?: string
  path: string
}

interface DirectoryStructure {
  [key: string]: FileItem[]
}

export default function FolderBrowser() {
  const [directoryStructure, setDirectoryStructure] = useState<DirectoryStructure>({})
  const [selectedItems, setSelectedItems] = useState<FileItem[]>([])
  const [outputContent, setOutputContent] = useState<string>('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [rootPath, setRootPath] = useState<string>('')
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())

  const isFileSystemAccessSupported = 'showDirectoryPicker' in window

  const selectFolder = useCallback(async () => {
    if (!isFileSystemAccessSupported) {
      alert('File System Access API is not supported in this browser. Please use Chrome, Edge, or another Chromium-based browser.')
      return
    }

    try {
      const directoryHandle = await window.showDirectoryPicker()
      setRootPath(directoryHandle.name)
      setExpandedFolders(new Set([directoryHandle.name])) // Auto-expand root folder
      await scanDirectory(directoryHandle, directoryHandle.name)
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Error selecting folder:', error)
        alert('Error selecting folder: ' + error.message)
      }
    }
  }, [])

  const scanDirectory = async (directoryHandle: FileSystemDirectoryHandle, currentPath: string) => {
    const items: FileItem[] = []
    const newStructure: DirectoryStructure = {}

    try {
      for await (const [name, handle] of directoryHandle.entries()) {
        const itemPath = currentPath === directoryHandle.name ? name : `${currentPath}/${name}`
        
        const item: FileItem = {
          handle: handle as FileSystemFileHandle | FileSystemDirectoryHandle,
          name,
          type: handle.kind,
          selected: false,
          path: itemPath
        }

        items.push(item)

        if (handle.kind === 'directory') {
          try {
            await scanDirectory(handle as FileSystemDirectoryHandle, itemPath)
          } catch (error) {
            console.warn(`Could not scan directory ${itemPath}:`, error)
          }
        }
      }

      newStructure[currentPath] = items
      setDirectoryStructure(prev => ({ ...prev, ...newStructure }))
    } catch (error) {
      console.error(`Error scanning directory ${currentPath}:`, error)
    }
  }

  const toggleFolderExpansion = useCallback((folderPath: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev)
      if (newSet.has(folderPath)) {
        newSet.delete(folderPath)
      } else {
        newSet.add(folderPath)
      }
      return newSet
    })
  }, [])

  const toggleItemSelection = useCallback((item: FileItem) => {
    const isCurrentlySelected = selectedItems.some(selected => selected.path === item.path)
    
    if (isCurrentlySelected) {
      // If deselecting a folder, also deselect all its children
      if (item.type === 'directory') {
        setSelectedItems(prev => prev.filter(selected => 
          selected.path !== item.path && !selected.path.startsWith(item.path + '/')
        ))
      } else {
        setSelectedItems(prev => prev.filter(selected => selected.path !== item.path))
      }
    } else {
      // If selecting a folder, also select all its children
      if (item.type === 'directory') {
        const childItems = getAllChildItems(item.path)
        setSelectedItems(prev => [...prev.filter(selected => 
          selected.path !== item.path && !selected.path.startsWith(item.path + '/')
        ), { ...item, selected: true }, ...childItems])
      } else {
        setSelectedItems(prev => [...prev, { ...item, selected: true }])
      }
    }
  }, [selectedItems])

  const getAllChildItems = useCallback((folderPath: string): FileItem[] => {
    const childItems: FileItem[] = []
    
    Object.entries(directoryStructure).forEach(([dirPath, items]) => {
      if (dirPath.startsWith(folderPath + '/') || dirPath === folderPath) {
        items.forEach(item => {
          if (item.path.startsWith(folderPath + '/')) {
            childItems.push({ ...item, selected: true })
          }
        })
      }
    })
    
    return childItems
  }, [directoryStructure])

  const processSelectedFiles = useCallback(async () => {
    if (selectedItems.length === 0) {
      alert('Please select at least one file or folder')
      return
    }

    setIsProcessing(true)
    let combinedContent = ''

    try {
      for (const item of selectedItems) {
        if (item.type === 'file') {
          try {
            const fileHandle = item.handle as FileSystemFileHandle
            const file = await fileHandle.getFile()
            const content = await file.text()
            
            combinedContent += `\n\n=== ${item.path} ===\n`
            combinedContent += content
          } catch (error) {
            console.error(`Error reading file ${item.path}:`, error)
            combinedContent += `\n\n=== ${item.path} ===\n`
            combinedContent += `[Error reading file: ${error instanceof Error ? error.message : 'Unknown error'}]`
          }
        } else if (item.type === 'directory') {
          combinedContent += await processDirectory(item.handle as FileSystemDirectoryHandle, item.path)
        }
      }

      setOutputContent(combinedContent.trim())
    } catch (error) {
      console.error('Error processing files:', error)
      alert('Error processing files: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setIsProcessing(false)
    }
  }, [selectedItems])

  const processDirectory = async (directoryHandle: FileSystemDirectoryHandle, basePath: string): Promise<string> => {
    let content = ''

    try {
      for await (const [name, handle] of directoryHandle.entries()) {
        const itemPath = `${basePath}/${name}`

        if (handle.kind === 'file') {
          try {
            const fileHandle = handle as FileSystemFileHandle
            const file = await fileHandle.getFile()
            const fileContent = await file.text()
            
            content += `\n\n=== ${itemPath} ===\n`
            content += fileContent
          } catch (error) {
            console.error(`Error reading file ${itemPath}:`, error)
            content += `\n\n=== ${itemPath} ===\n`
            content += `[Error reading file: ${error instanceof Error ? error.message : 'Unknown error'}]`
          }
        } else if (handle.kind === 'directory') {
          content += await processDirectory(handle as FileSystemDirectoryHandle, itemPath)
        }
      }
    } catch (error) {
      console.error(`Error processing directory ${basePath}:`, error)
    }

    return content
  }

  const copyToClipboard = useCallback(async () => {
    if (!outputContent) {
      alert('No content to copy')
      return
    }

    try {
      await navigator.clipboard.writeText(outputContent)
      alert('Content copied to clipboard!')
    } catch (error) {
      console.error('Error copying to clipboard:', error)
      alert('Error copying to clipboard. Please select and copy manually.')
    }
  }, [outputContent])

  const clearSelection = useCallback(() => {
    setSelectedItems([])
    setOutputContent('')
  }, [])

  const clearAll = useCallback(() => {
    setSelectedItems([])
    setOutputContent('')
    setDirectoryStructure({})
    setExpandedFolders(new Set())
    setRootPath('')
  }, [])

  const getChildrenForPath = (parentPath: string): FileItem[] => {
    // Find the directory structure entry for this path
    const directChildren = directoryStructure[parentPath] || []
    return directChildren
  }

  const renderFileItem = (item: FileItem, depth: number = 0) => {
    const isSelected = selectedItems.some(selected => selected.path === item.path)
    const isExpanded = expandedFolders.has(item.path)
    const children = item.type === 'directory' ? getChildrenForPath(item.path) : []
    const hasChildren = children.length > 0

    return (
      <div key={item.path}>
        <div className={`flex items-center space-x-1 py-1 hover:bg-muted/50 rounded px-1`} style={{ marginLeft: `${depth * 20}px` }}>
          {item.type === 'directory' ? (
            <Button
              variant="ghost"
              size="icon"
              className="w-4 h-4 p-0 hover:bg-muted/80 cursor-pointer transition-colors"
              onClick={() => toggleFolderExpansion(item.path)}
            >
              {hasChildren ? (
                isExpanded ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )
              ) : (
                <div className="w-3 h-3" />
              )}
            </Button>
          ) : (
            <div className="w-4 h-4" />
          )}
          
          <Checkbox
            id={item.path}
            checked={isSelected}
            onCheckedChange={() => toggleItemSelection(item)}
            className="cursor-pointer"
          />
          
          <Label 
            htmlFor={item.path}
            className="flex items-center space-x-2 cursor-pointer font-mono text-sm flex-1 hover:bg-muted/30 rounded px-1 py-0.5 transition-colors"
          >
            {item.type === 'directory' ? (
              isExpanded ? (
                <FolderOpen className="w-4 h-4 text-blue-600 flex-shrink-0" />
              ) : (
                <Folder className="w-4 h-4 text-blue-600 flex-shrink-0" />
              )
            ) : (
              <File className="w-4 h-4 text-gray-600 flex-shrink-0" />
            )}
            <span className={`${item.type === 'directory' ? 'text-blue-600 font-medium' : 'text-gray-700'} truncate`}>
              {item.name}
            </span>
          </Label>
        </div>
        
        {item.type === 'directory' && isExpanded && hasChildren && (
          <div>
            {children.map(childItem => renderFileItem(childItem, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  if (!isFileSystemAccessSupported) {
    return (
      <div className="p-8">
        <Card className="max-w-2xl mx-auto border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-700">Browser Not Supported</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-600 mb-2">
              This app requires the File System Access API, which is only available in modern Chromium-based browsers (Chrome, Edge, etc.).
            </p>
            <p className="text-red-600">
              Please use a supported browser to access local files.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 min-h-screen">
      <div className="flex flex-wrap gap-4 mb-6">
        <Button onClick={selectFolder} className="flex items-center gap-2 cursor-pointer">
          <FolderOpen className="w-4 h-4" />
          Select Folder
        </Button>
        {Object.keys(directoryStructure).length > 0 && (
          <>
            <Button 
              onClick={processSelectedFiles} 
              disabled={selectedItems.length === 0 || isProcessing}
              variant="secondary"
              className="flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                `Process Selected (${selectedItems.length})`
              )}
            </Button>
            <Button onClick={clearSelection} variant="outline" className="cursor-pointer">
              Clear Selection
            </Button>
            <Button onClick={clearAll} variant="destructive" className="cursor-pointer">
              Clear All
            </Button>
          </>
        )}
      </div>

      {rootPath && (
        <Card className="mb-6">
          <CardContent>
            <p className="text-sm">
              <strong>Current folder:</strong> {rootPath}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-6 min-h-0 flex-1">
        <div className="flex-1">
          {Object.keys(directoryStructure).length > 0 && (
            <Card className="h-full flex flex-col">
              <CardHeader className="flex-shrink-0">
                <CardTitle>Select files and folders:</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto space-y-1 min-h-0">
                {rootPath && directoryStructure[rootPath] && 
                  directoryStructure[rootPath].map(item => renderFileItem(item, 0))
                }
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex-1">
          <Card className="h-full flex flex-col">
            <CardHeader className="flex-row items-center justify-between space-y-0 flex-shrink-0">
              <CardTitle>File Contents:</CardTitle>
              {outputContent && (
                <Button onClick={copyToClipboard} size="sm" className="flex items-center gap-2 cursor-pointer">
                  <Copy className="w-4 h-4" />
                  Copy to Clipboard
                </Button>
              )}
            </CardHeader>
            <CardContent className="flex-1 pb-4 min-h-0">
              <Textarea
                value={outputContent}
                readOnly
                placeholder="Processed file contents will appear here..."
                className="h-full font-mono text-sm resize-none"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}