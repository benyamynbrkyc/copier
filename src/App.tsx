import FolderBrowser from './components/folder-browser'

function App() {
  return (
    <div className="min-h-screen bg-background">
      <header className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-8 text-center shadow-lg">
        <h1 className="text-4xl font-semibold mb-2">File Copier for LLMs</h1>
        <p className="text-lg opacity-90">Select files and folders to copy their contents for AI chat</p>
      </header>
      <main className="flex-1 bg-muted/30">
        <FolderBrowser />
      </main>
    </div>
  )
}

export default App
