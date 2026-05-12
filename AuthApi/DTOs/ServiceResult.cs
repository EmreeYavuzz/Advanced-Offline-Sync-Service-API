namespace AuthApi.DTOs
{
    public class ServiceResult
    {
        public bool Succeeded { get; init; }
        public string Message { get; init; } = string.Empty;
        public IReadOnlyCollection<string> Errors { get; init; } = [];

        public static ServiceResult Success(string message) => new()
        {
            Succeeded = true,
            Message = message
        };

        public static ServiceResult Failure(params string[] errors) => new()
        {
            Succeeded = false,
            Errors = errors
        };
    }

    public class ServiceResult<T> : ServiceResult
    {
        public T? Data { get; init; }

        public static ServiceResult<T> Success(T data, string message = "") => new()
        {
            Succeeded = true,
            Data = data,
            Message = message
        };

        public new static ServiceResult<T> Failure(params string[] errors) => new()
        {
            Succeeded = false,
            Errors = errors
        };
    }
}
