using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SpecialPrograms.Api.Data;

namespace SpecialPrograms.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = "AdminOnly")]
public class AdminController(ApplicationDbContext context) : ControllerBase
{
    [HttpGet("dashboard")]
    public async Task<IActionResult> GetDashboard()
    {
        var now = DateTime.UtcNow;
        var students = await context.Students.CountAsync();
        var assessments = await context.NeedsAssessments.CountAsync();
        var goals = await context.Goals.CountAsync();
        var activeGoals = await context.Goals.CountAsync(g => g.Status != "Completed");
        var completedGoals = goals - activeGoals;
        var progressUpdates = await context.ProgressUpdates.CountAsync();
        var reviewsDueSoon = await context.Students.CountAsync(s => s.NextReviewDate != null && s.NextReviewDate <= now.AddDays(30));

        return Ok(new
        {
            Students = students,
            NeedsAssessments = assessments,
            Goals = goals,
            ActiveGoals = activeGoals,
            CompletedGoals = completedGoals,
            ProgressUpdates = progressUpdates,
            ReviewsDueWithin30Days = reviewsDueSoon
        });
    }
}
