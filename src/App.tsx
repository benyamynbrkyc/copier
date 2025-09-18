import FolderBrowser from './components/folder-browser'

function App() {
  return (
    <div className="min-h-screen bg-background">
      <header className="p-8 border text-center shadow">
        <h1 className="text-4xl font-semibold mb-2">File Copier for LLMs (dok ne dodje copilot)</h1>
        <p className="text-lg opacity-90">Select files and folders to copy their contents for AI chat</p>
      </header>
      <main className="flex-1 bg-muted/30">
        <FolderBrowser />
      </main>
    </div>
  )
}

export default App
