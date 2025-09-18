import { useState, useCallback } from 'react'
import './folder-browser.css'

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
      <div key={path} className={`directory-level depth-${depth}`}>
        {depth > 0 && (
          <div className="directory-header">
            <span className="directory-name">{path.split('/').pop()}/</span>
          </div>
        )}
        {items.map((item) => (
          <div key={item.path} className="file-item">
            <label className="file-label">
              <input
                type="checkbox"
                checked={selectedItems.some(selected => selected.path === item.path)}
                onChange={() => toggleItemSelection(item)}
              />
              <span className={`file-name ${item.type}`}>
                {item.type === 'directory' ? '📁' : '📄'} {item.name}
              </span>
            </label>
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
      <div className="folder-browser error">
        <h2>Browser Not Supported</h2>
        <p>This app requires the File System Access API, which is only available in modern Chromium-based browsers (Chrome, Edge, etc.).</p>
        <p>Please use a supported browser to access local files.</p>
      </div>
    )
  }

  return (
    <div className="folder-browser">
      <div className="controls">
        <button onClick={selectFolder} className="primary-button">
          Select Folder
        </button>
        {Object.keys(directoryStructure).length > 0 && (
          <>
            <button 
              onClick={processSelectedFiles} 
              disabled={selectedItems.length === 0 || isProcessing}
              className="secondary-button"
            >
              {isProcessing ? 'Processing...' : `Process Selected (${selectedItems.length})`}
            </button>
            <button onClick={clearSelection} className="tertiary-button">
              Clear Selection
            </button>
          </>
        )}
      </div>

      {rootPath && (
        <div className="current-folder">
          <strong>Current folder:</strong> {rootPath}
        </div>
      )}

      <div className="browser-content">
        <div className="left-panel">
          {Object.keys(directoryStructure).length > 0 && (
            <div className="file-tree">
              <h3>Select files and folders:</h3>
              <div className="tree-container">
                {Object.entries(directoryStructure)
                  .filter(([path]) => !path.includes('/'))
                  .map(([path, items]) => renderDirectoryTree(path, items))}
              </div>
            </div>
          )}
        </div>

        <div className="right-panel">
          <div className="output-section">
            <div className="output-header">
              <h3>File Contents:</h3>
              {outputContent && (
                <button onClick={copyToClipboard} className="copy-button">
                  Copy to Clipboard
                </button>
              )}
            </div>
            <textarea
              className="output-textarea"
              value={outputContent}
              readOnly
              placeholder="Processed file contents will appear here..."
            />
          </div>
        </div>
      </div>
    </div>
  )
}
