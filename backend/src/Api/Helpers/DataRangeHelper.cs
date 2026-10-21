public static class DateRangeHelper
{
    private static readonly TimeZoneInfo FusoSaoPaulo =
        TimeZoneInfo.FindSystemTimeZoneById(
            OperatingSystem.IsWindows()
                ? "E. South America Standard Time"
                : "America/Sao_Paulo");

    public static DateTime InicioUtc(DateTime data)
    {
        var dataLocal = DateTime.SpecifyKind(
            data.Date,
            DateTimeKind.Unspecified);

        return TimeZoneInfo.ConvertTimeToUtc(
            dataLocal,
            FusoSaoPaulo);
    }

    public static DateTime FimExclusivoUtc(DateTime dataFinal)
    {
        return InicioUtc(dataFinal.Date.AddDays(1));
    }

    public static DateTime DataLocal(DateTime dataUtc)
    {
        var utc = DateTime.SpecifyKind(
            dataUtc,
            DateTimeKind.Utc);

        return TimeZoneInfo.ConvertTimeFromUtc(
            utc,
            FusoSaoPaulo);
    }
}