import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { FolderOpen, File, Copy, Loader2 } from 'lucide-react'

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

  const isFileSystemAccessSupported = 'showDirectoryPicker' in window

  const selectFolder = useCallback(async () => {
    if (!isFileSystemAccessSupported) {
      alert('File System Access API is not supported in this browser. Please use Chrome, Edge, or another Chromium-based browser.')
      return
    }

    try {
      const directoryHandle = await window.showDirectoryPicker()
      setRootPath(directoryHandle.name)
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

  const toggleItemSelection = useCallback((item: FileItem) => {
    const isCurrentlySelected = selectedItems.some(selected => selected.path === item.path)
    
    if (isCurrentlySelected) {
      setSelectedItems(prev => prev.filter(selected => selected.path !== item.path))
    } else {
      setSelectedItems(prev => [...prev, { ...item, selected: true }])
    }
  }, [selectedItems])

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

  const renderDirectoryTree = (path: string, items: FileItem[], depth = 0) => {
    return (
      <div key={path} className={`${depth > 0 ? `ml-${depth * 4}` : ''}`}>
        {depth > 0 && (
          <div className="font-medium text-blue-600 mb-2">
            <FolderOpen className="inline w-4 h-4 mr-1" />
            {path.split('/').pop()}/
          </div>
        )}
        {items.map((item) => (
          <div key={item.path} className="flex items-center space-x-2 py-1">
            <Checkbox
              id={item.path}
              checked={selectedItems.some(selected => selected.path === item.path)}
              onCheckedChange={() => toggleItemSelection(item)}
            />
            <Label 
              htmlFor={item.path}
              className="flex items-center space-x-1 cursor-pointer font-mono text-sm"
            >
              {item.type === 'directory' ? (
                <FolderOpen className="w-4 h-4 text-blue-600" />
              ) : (
                <File className="w-4 h-4 text-gray-600" />
              )}
              <span className={item.type === 'directory' ? 'text-blue-600 font-medium' : 'text-gray-700'}>
                {item.name}
              </span>
            </Label>
          </div>
        ))}
        {Object.entries(directoryStructure)
          .filter(([dirPath]) => dirPath.startsWith(path + '/') && dirPath.split('/').length === path.split('/').length + 1)
          .map(([dirPath, dirItems]) => renderDirectoryTree(dirPath, dirItems, depth + 1))}
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
        <Button onClick={selectFolder} className="flex items-center gap-2">
          <FolderOpen className="w-4 h-4" />
          Select Folder
        </Button>
        {Object.keys(directoryStructure).length > 0 && (
          <>
            <Button 
              onClick={processSelectedFiles} 
              disabled={selectedItems.length === 0 || isProcessing}
              variant="secondary"
              className="flex items-center gap-2"
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
            <Button onClick={clearSelection} variant="outline">
              Clear Selection
            </Button>
          </>
        )}
      </div>

      {rootPath && (
        <Card className="mb-6">
          <CardContent className="pt-4">
            <p className="text-sm">
              <strong>Current folder:</strong> {rootPath}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-6 min-h-0 flex-1">
        <div className="flex-1">
          {Object.keys(directoryStructure).length > 0 && (
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Select files and folders:</CardTitle>
              </CardHeader>
              <CardContent className="overflow-y-auto max-h-96">
                {Object.entries(directoryStructure)
                  .filter(([path]) => !path.includes('/'))
                  .map(([path, items]) => renderDirectoryTree(path, items))}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex-1">
          <Card className="h-full">
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>File Contents:</CardTitle>
              {outputContent && (
                <Button onClick={copyToClipboard} size="sm" className="flex items-center gap-2">
                  <Copy className="w-4 h-4" />
                  Copy to Clipboard
                </Button>
              )}
            </CardHeader>
            <CardContent className="h-full pb-4">
              <Textarea
                value={outputContent}
                readOnly
                placeholder="Processed file contents will appear here..."
                className="min-h-96 font-mono text-sm resize-none"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}