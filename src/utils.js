const chars =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
const Base64 = {
  btoa: (input = "") => {
    let str = input;
    let output = "";

    for (
      let block = 0, charCode, i = 0, map = chars;
      // eslint-disable-next-line no-bitwise
      str.charAt(i | 0) || ((map = "="), i % 1);
      // eslint-disable-next-line no-bitwise
      output += map.charAt(63 & (block >> (8 - (i % 1) * 8)))
    ) {
      charCode = str.charCodeAt((i += 3 / 4));

      if (charCode > 0xff) {
        throw new Error(
          "'btoa' failed: The string to be encoded contains characters outside of the Latin1 range."
        );
      }

      // eslint-disable-next-line no-bitwise
      block = (block << 8) | charCode;
    }

    return output;
  },

  atob: (input = "") => {
    let str = input.replace(/[=]+$/, "");
    let output = "";

    if (str.length % 4 == 1) {
      throw new Error(
        "'atob' failed: The string to be decoded is not correctly encoded."
      );
    }
    for (
      let bc = 0, bs = 0, buffer, i = 0;
      (buffer = str.charAt(i++));
      // eslint-disable-next-line no-bitwise
      ~buffer && ((bs = bc % 4 ? bs * 64 + buffer : buffer), bc++ % 4)
        ? // eslint-disable-next-line no-bitwise
        (output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6))))
        : 0
    ) {
      buffer = chars.indexOf(buffer);
    }

    return output;
  },
};

function _base64ToArrayBuffer(base64) {
  let binary_string = Base64.atob(base64);
  let len = binary_string.length;
  let bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

export const decrypt = (inputString) => {
  const xorKey = "1StepUp1VietNam@";
  let decode = _base64ToArrayBuffer(inputString);
  let decodeString = new TextDecoder("utf-8").decode(new Uint8Array(decode));

  let bytes = [];
  for (let i = 0; i < decodeString.length; i++) {
    let index = i >= xorKey.length ? xorKey.length - 1 : i;
    bytes[i] = String.fromCharCode(
      // eslint-disable-next-line no-bitwise
      decodeString.charCodeAt(i) ^ xorKey.charCodeAt(index)
    );
  }
  try {
    const jsonString = bytes.join("");
    if (jsonString.trim() === '') {
      throw new Error('Empty JSON string');
    }
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Error parsing decrypted data:', error);
    return null;
  }
};

// API function to check pronunciation
export const checkPronunciation = async (audioBlob, textRefs, requestId = 'unknown') => {
  console.log('checkPronunciation called with:', {
    requestId,
    audioBlobSize: audioBlob.size,
    textRefs: textRefs,
    timestamp: new Date().toISOString()
  });

  try {
    const formData = new FormData();
    formData.append('audio-file', audioBlob, 'recording.wav');
    formData.append('text-refs', textRefs);

    console.log('Sending API request:', { requestId, textRefs, timestamp: new Date().toISOString() });

    const response = await fetch('https://tofutest.stepup.edu.vn/speech/api/v1/check/tofu-open/speech?app_user_id=7445&app_device_id=EC2C5948-3B80-40F6-BF44-1487E7C7435D3&app_v=2.5.7&platform=ios-18.7&app_user_tier=free', {
      method: 'POST',
      headers: {
        'Accept': 'application/json'
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('Raw API response:', { requestId, result, timestamp: new Date().toISOString() });

    if (result.data) {
      const decryptedData = decrypt(result.data);
      console.log('🎯 Decrypted API data SUCCESS:', { 
        requestId, 
        decryptedData,
        hasValidData: !!decryptedData,
        totalScore: decryptedData?.total_score,
        textRefs: decryptedData?.text_refs,
        hasLetters: decryptedData?.result?.[0]?.letters?.length > 0,
        timestamp: new Date().toISOString() 
      });
      
      // Verify the response matches the request (case insensitive)
      if (decryptedData && decryptedData.text_refs?.toLowerCase() !== textRefs.toLowerCase()) {
        console.error('🚨 API RESPONSE MISMATCH DETECTED:', {
          requestId,
          requested: textRefs,
          received: decryptedData.text_refs,
          requestedLower: textRefs.toLowerCase(),
          receivedLower: decryptedData.text_refs?.toLowerCase(),
          timestamp: new Date().toISOString()
        });
        
        // Return null to force fallback when there's a mismatch
        return null;
      }
      
      console.log('✅ API data validation passed, returning REAL data:', {
        requestId,
        textRefs: decryptedData.text_refs,
        totalScore: decryptedData.total_score,
        lettersCount: decryptedData.result?.[0]?.letters?.length
      });
      return decryptedData;
    } else {
      throw new Error('No data in response');
    }
  } catch (error) {
    console.error('Error checking pronunciation:', error);
    return null;
  }
};