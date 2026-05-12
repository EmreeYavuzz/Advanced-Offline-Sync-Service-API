using AuthApi.Constants;
using Microsoft.AspNetCore.Identity;

namespace AuthApi.Services
{
    public class RoleSeeder(RoleManager<IdentityRole> roleManager)
    {
        private readonly RoleManager<IdentityRole> _roleManager = roleManager;

        public async Task SeedAsync()
        {
            foreach (var role in AuthRoles.All)
            {
                if (!await _roleManager.RoleExistsAsync(role))
                {
                    await _roleManager.CreateAsync(new IdentityRole(role));
                }
            }
        }
    }
}
