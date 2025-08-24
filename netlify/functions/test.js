export const handler = async (event, context) => {
  console.log('🔍 TEST function called');
  console.log('Method:', event.httpMethod);
  
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      message: 'Test function works!',
      timestamp: new Date().toISOString(),
      method: event.httpMethod,
      environment: {
        hasSupabaseUrl: !!process.env.SUPABASE_URL,
        hasJwtSecret: !!process.env.JWT_SECRET
      }
    })
  };
};