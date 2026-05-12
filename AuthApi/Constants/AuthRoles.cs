namespace AuthApi.Constants
{
    public static class AuthRoles
    {
        public const string Admin = "Admin";
        public const string IndividualUser = "IndividualUser";
        public const string CorporateUser = "CorporateUser";

        public static readonly string[] All = [Admin, IndividualUser, CorporateUser];
    }
}
