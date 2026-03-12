/**
 * OpenAI Streaming Utility
 * Connects to Modal serverless function and handles SSE streaming
 * Requires config.js to be loaded first (sets window.APP_CONFIG)
 */

/**
 * Stream chat completion from Modal endpoint
 * @param {string} code - source code to be analyzed by the LLM
 * @param {String} model - OpenAI model name
 * @param {object} json_schema - JSON schema describing response structure
 * @param {string} instructions - system prompt explaining how to analyze the code
 * @returns {AsyncGenerator} - Yields chunks of content as they arrive
 */
async function* chatCompletion(code, model = 'gpt-5-nano', instructions, json_schema ) {
  const MODAL_ENDPOINT_URL = window.APP_CONFIG?.MODAL_ENDPOINT_URL;
  if (!MODAL_ENDPOINT_URL) {
    throw new Error('MODAL_ENDPOINT_URL is not configured — check config.js');
  }

  try {
    const response = await fetch(MODAL_ENDPOINT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code,
        model,
        instructions,
        json_schema
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body.getReader(); 
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      // Decode chunk and add to buffer
      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE messages (lines starting with "data: ")
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6); // Remove "data: " prefix
          
          try {
            const data = JSON.parse(dataStr);
            
            if (data.type === 'content') {
              yield data.content;
            } else if (data.type === 'done') {
              return; // Stream complete
            } else if (data.type === 'error') {
              throw new Error(data.error);
            }
          } catch (parseError) {
            // If this is an intentionally thrown Error (not a SyntaxError from JSON.parse), re-throw it
            if (!(parseError instanceof SyntaxError)) {
              throw parseError;
            }
            console.warn('Failed to parse SSE data:', dataStr, parseError);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error in streamChatCompletion:', error);
    throw error;
  }
}


window.chatCompletion = chatCompletion; // Expose function globally for use in LLMParser


