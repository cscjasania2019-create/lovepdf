import React from 'react';
import './App.css';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import Home from './pages/Home';
import ToolPage from './pages/ToolPage';
import SignPage from './pages/SignPage';
import ImageToolPage from './pages/ImageToolPage';

function App() {
  return (
    <ThemeProvider>
      <div className="App">
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/tool/sign-pdf" element={<SignPage />} />
            <Route path="/tool/compress-image" element={<ImageToolPage />} />
            <Route path="/tool/crop-image" element={<ImageToolPage />} />
            <Route path="/tool/remove-background" element={<ImageToolPage />} />
            <Route path="/tool/photo-text" element={<ImageToolPage />} />
            <Route path="/tool/:slug" element={<ToolPage />} />
          </Routes>
        </BrowserRouter>
      </div>
    </ThemeProvider>
  );
}

export default App;
