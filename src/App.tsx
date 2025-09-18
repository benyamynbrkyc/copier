import './App.css'
import FolderBrowser from './components/folder-browser'

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>File Copier for LLMs</h1>
        <p>Select files and folders to copy their contents for AI chat</p>
      </header>
      <main className="app-main">
        <FolderBrowser />
      </main>
    </div>
  )
}

export default App
