using AuthApi.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AuthApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ProtectedController : ControllerBase
    {
        [HttpGet("me")]
        [Authorize]
        public IActionResult Me()
        {
            return Ok(new { message = "Authenticated request succeeded." });
        }

        [HttpGet("admin")]
        [Authorize(Roles = AuthRoles.Admin)]
        public IActionResult Admin()
        {
            return Ok(new { message = "Admin endpoint reached." });
        }

        [HttpGet("individual")]
        [Authorize(Roles = AuthRoles.IndividualUser)]
        public IActionResult Individual()
        {
            return Ok(new { message = "Individual user endpoint reached." });
        }

        [HttpGet("corporate")]
        [Authorize(Roles = AuthRoles.CorporateUser)]
        public IActionResult Corporate()
        {
            return Ok(new { message = "Corporate user endpoint reached." });
        }
    }
}
