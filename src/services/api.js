const API_BASE_URL = 'http://localhost:8000';

export const transcribeFile = async (file, stream = false, prompt = '') => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('stream', stream);
  if (prompt) formData.append('prompt', prompt);

  if (stream) {
    const response = await fetch(`${API_BASE_URL}/v1/transcribe`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('File transcription failed');
    }

    const reader = response.body.getReader();
    return reader;
  } else {
    const response = await fetch(`${API_BASE_URL}/v1/transcribe`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('File transcription failed');
    }

    return response.json();
  }
};

export const startLiveTranscription = async (onMessage, onError) => {
  const ws = new WebSocket(`ws://localhost:8000/v1/live_transcription`);

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    onMessage(data);
  };

  ws.onerror = (error) => {
    onError(error);
  };

  return ws;
};

export const stopLiveTranscription = (ws) => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.close();
  }
};

export const getServerMetadata = async () => {
  const response = await fetch(`${API_BASE_URL}/metadata`);
  if (!response.ok) {
    throw new Error('Failed to fetch server metadata');
  }
  return response.json();
};

export const getServerStats = async () => {
  const response = await fetch(`${API_BASE_URL}/stats`);
  if (!response.ok) {
    throw new Error('Failed to fetch server stats');
  }
  return response.json();
};