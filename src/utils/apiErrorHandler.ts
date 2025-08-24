import { toast } from '@/hooks/use-toast';

export interface ApiResponse<T = any> {
  ok: boolean;
  data?: T;
  code?: string;
  message: string;
}

export interface ApiError {
  code?: string;
  message: string;
  details?: any;
}

/**
 * Standardized API error handler that returns consistent format
 * Never exposes raw stack traces to users
 */
export function handleApiError(error: any, context?: string): ApiResponse {
  console.error(`[API Error] ${context || 'Unknown'}:`, {
    message: error?.message || 'Unknown error',
    code: error?.code,
    timestamp: new Date().toISOString(),
  });

  // Extract meaningful error info without exposing internals
  let code = 'UNKNOWN_ERROR';
  let message = 'Something went wrong. Please try again.';

  if (error?.code) {
    code = error.code;
  }

  if (error?.message) {
    // Common Supabase/Postgres error patterns
    if (error.message.includes('duplicate key')) {
      code = 'DUPLICATE_ENTRY';
      message = 'This entry already exists.';
    } else if (error.message.includes('foreign key')) {
      code = 'INVALID_REFERENCE';
      message = 'Referenced item not found.';
    } else if (error.message.includes('permission')) {
      code = 'PERMISSION_DENIED';
      message = 'You do not have permission to perform this action.';
    } else if (error.message.includes('not found')) {
      code = 'NOT_FOUND';
      message = 'The requested item was not found.';
    } else if (error.message.includes('network')) {
      code = 'NETWORK_ERROR';
      message = 'Network connection failed. Please check your connection.';
    } else {
      // Use the error message if it's user-friendly, otherwise use default
      const isUserFriendly = !error.message.includes('function') && 
                            !error.message.includes('syntax') &&
                            !error.message.includes('stack');
      if (isUserFriendly && error.message.length < 100) {
        message = error.message;
      }
    }
  }

  return {
    ok: false,
    code,
    message,
  };
}

/**
 * Show standardized error toast with consistent copy
 */
export function showErrorToast(error: ApiResponse | string, title?: string) {
  const message = typeof error === 'string' ? error : error.message;
  
  toast({
    title: title || "Something went wrong",
    description: message || "We couldn't complete that action. Nothing has been lost.",
    variant: "destructive",
  });
}

/**
 * Show standardized success toast
 */
export function showSuccessToast(message: string, title?: string) {
  toast({
    title: title || "Success",
    description: message,
  });
}

/**
 * Wrapper for Supabase calls that returns standardized format
 */
export async function safeApiCall<T>(
  apiCall: () => Promise<any>,
  context?: string
): Promise<ApiResponse<T>> {
  try {
    const result = await apiCall();
    
    if (result.error) {
      return handleApiError(result.error, context);
    }
    
    return {
      ok: true,
      data: result.data,
      message: 'Success',
    };
  } catch (error) {
    return handleApiError(error, context);
  }
}