export const handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization,Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const token = authHeader && authHeader.split(' ')[1];

    const debugInfo = {
      timestamp: new Date().toISOString(),
      environment: {
        JWT_SECRET_exists: !!process.env.JWT_SECRET,
        SUPABASE_URL_exists: !!process.env.SUPABASE_URL,  
        SUPABASE_SECRET_exists: !!process.env.SUPABASE_SECRET,
        NODE_ENV: process.env.NODE_ENV || 'undefined',
        JWT_SECRET_length: process.env.JWT_SECRET?.length || 0
      },
      request: {
        httpMethod: event.httpMethod,
        path: event.path,
        headers_count: Object.keys(event.headers).length,
        headers: Object.keys(event.headers),
        has_authorization: !!authHeader,
        token_present: !!token,
        token_length: token?.length || 0,
        token_preview: token ? `${token.substring(0, 20)}...` : 'none'
      }
    };

    // Try to decode token if present
    if (token && process.env.JWT_SECRET) {
      try {
        const jwt = await import('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        debugInfo.token_validation = {
          success: true,
          userId: decoded.userId,
          email: decoded.email,
          id: decoded.id,
          expires: new Date(decoded.exp * 1000).toISOString()
        };
      } catch (error) {
        debugInfo.token_validation = {
          success: false,
          error: error.message,
          name: error.name
        };
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(debugInfo, null, 2)
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack
      })
    };
  }
};