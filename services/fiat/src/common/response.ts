export function successResponse<T>(data: T, message = 'success') {
  return { success: true, message, data };
}

export function paginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
) {
  return {
    success: true,
    data,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
}
