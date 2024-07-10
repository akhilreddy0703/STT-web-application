import React, { useState, useEffect } from 'react';
import { transcribeFile, startLiveTranscription, stopLiveTranscription, getServerMetadata, getServerStats } from '../services/api';
import '../App.css';

const TranscriptionUI = () => {
  const [fileTranscription, setFileTranscription] = useState('');
  const [fileMetadata, setFileMetadata] = useState(null);
  const [liveTranscription, setLiveTranscription] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [useStreaming, setUseStreaming] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [serverMetadata, setServerMetadata] = useState(null);
  const [serverStats, setServerStats] = useState(null);
  const [ws, setWs] = useState(null);
  const [activeTab, setActiveTab] = useState('file');

  useEffect(() => {
    fetchMetadataAndStats();
  }, []);

  const fetchMetadataAndStats = async () => {
    try {
      const [metadataResponse, statsResponse] = await Promise.all([
        getServerMetadata(),
        getServerStats()
      ]);
      setServerMetadata(metadataResponse);
      setServerStats(statsResponse);
    } catch (error) {
      console.error('Error fetching metadata and stats:', error);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (file) {
      try {
        setFileTranscription('');
        setFileMetadata(null);
        
        if (useStreaming) {
          const reader = await transcribeFile(file, true, prompt);
          const decoder = new TextDecoder();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value);
            setFileTranscription(prev => prev + chunk);
          }
        } else {
          const result = await transcribeFile(file, false, prompt);
          setFileTranscription(result.transcription);
          setFileMetadata({
            language: result.language,
            language_probability: result.language_probability,
            inference_time: result.inference_time,
            audio_duration: result.audio_duration
          });
        }
        fetchMetadataAndStats();
      } catch (error) {
        console.error('Error transcribing file:', error);
        setFileTranscription('Error transcribing file. Please try again.');
      }
    }
  };

  const toggleRecording = () => {
    if (!isRecording) {
      const newWs = startLiveTranscription();
      newWs.onmessage = (event) => {
        const data = JSON.parse(event.data);
        const words = data.words.map(w => w.word).join(' ');
        setLiveTranscription(prev => prev + ' ' + words);
      };
      newWs.onerror = (error) => {
        console.error('WebSocket error:', error);
        setLiveTranscription('Error in live transcription. Please try again.');
      };
      setWs(newWs);
      setIsRecording(true);
    } else {
      stopLiveTranscription(ws);
      setWs(null);
      setIsRecording(false);
      fetchMetadataAndStats();
    }
  };

  return (
    <div className="container">
      <h1 className="title">Speech-to-Text Transcription</h1>
      <div className="tabs">
        <button className={`tab ${activeTab === 'file' ? 'active' : ''}`} onClick={() => setActiveTab('file')}>File Transcription</button>
        <button className={`tab ${activeTab === 'live' ? 'active' : ''}`} onClick={() => setActiveTab('live')}>Live Transcription</button>
      </div>
      {activeTab === 'file' && (
        <div className="card">
          <h2>Upload Audio File</h2>
          <div className="input-group">
            <input type="file" onChange={handleFileUpload} accept="audio/*" className="input" />
            <button className="button">Upload</button>
          </div>
          <div className="checkbox-group">
            <input type="checkbox" id="streaming" checked={useStreaming} onChange={(e) => setUseStreaming(e.target.checked)} />
            <label htmlFor="streaming">Use streaming</label>
          </div>
          <input 
            type="text" 
            placeholder="Enter prompt (optional)" 
            value={prompt} 
            onChange={(e) => setPrompt(e.target.value)}
            className="input"
          />
          <div className="transcription-area">
            {fileTranscription}
          </div>
          {fileMetadata && (
            <div className="metadata">
              <h3>Transcription Metadata:</h3>
              <p>Language: {fileMetadata.language}</p>
              <p>Language Probability: {fileMetadata.language_probability.toFixed(2)}</p>
              <p>Inference Time: {fileMetadata.inference_time.toFixed(2)}s</p>
              <p>Audio Duration: {fileMetadata.audio_duration.toFixed(2)}s</p>
            </div>
          )}
        </div>
      )}
      {activeTab === 'live' && (
        <div className="card">
          <h2>Live Microphone Transcription</h2>
          <button onClick={toggleRecording} className="button">
            {isRecording ? 'Stop Recording' : 'Start Recording'}
          </button>
          <div className="transcription-area">
            {liveTranscription}
          </div>
        </div>
      )}
      {(serverMetadata || serverStats) && (
        <div className="card">
          <h2>Server Information</h2>
          {serverMetadata && (
            <div className="metadata">
              <h3>Metadata:</h3>
              <p>Model ID: {serverMetadata.model_id}</p>
              <p>Backend: {serverMetadata.backend}</p>
              <p>Device: {serverMetadata.device}</p>
              <p>Quantization: {serverMetadata.quantization}</p>
            </div>
          )}
          {serverStats && (
            <div className="metadata">
              <h3>Stats:</h3>
              <p>Total Requests: {serverStats.total_requests}</p>
              <p>Total Audio Duration: {serverStats.total_audio_duration.toFixed(2)}s</p>
              <p>Total Inference Time: {serverStats.total_inference_time.toFixed(2)}s</p>
              <p>Average Inference Time: {serverStats.average_inference_time.toFixed(2)}s</p>
              <p>Real Time Factor: {serverStats.real_time_factor.toFixed(2)}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TranscriptionUI;