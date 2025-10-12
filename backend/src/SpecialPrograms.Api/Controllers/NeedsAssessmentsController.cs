using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SpecialPrograms.Api.Dtos;
using SpecialPrograms.Api.Services;

namespace SpecialPrograms.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class NeedsAssessmentsController(INeedsAssessmentService service) : ControllerBase
{
    [HttpGet("student/{studentId}")]
    public async Task<ActionResult<IEnumerable<NeedsAssessmentDto>>> GetByStudent(Guid studentId)
    {
        var result = await service.GetForStudentAsync(studentId);
        return Ok(result);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<NeedsAssessmentDto>> GetById(Guid id)
    {
        var assessment = await service.GetAsync(id);
        return assessment is null ? NotFound() : Ok(assessment);
    }

    [HttpPost]
    public async Task<ActionResult<NeedsAssessmentDto>> Post(NeedsAssessmentCreateDto dto)
    {
        var created = await service.CreateAsync(dto);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<NeedsAssessmentDto>> Put(Guid id, NeedsAssessmentUpdateDto dto)
    {
        var updated = await service.UpdateAsync(id, dto);
        return updated is null ? NotFound() : Ok(updated);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var deleted = await service.DeleteAsync(id);
        return deleted ? NoContent() : NotFound();
    }
}
