using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SpecialPrograms.Api.Dtos;
using SpecialPrograms.Api.Services;

namespace SpecialPrograms.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class StudentsController(IStudentService students) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<StudentSummaryDto>>> Get()
    {
        var result = await students.GetAllAsync();
        return Ok(result);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<StudentDetailDto>> GetById(Guid id)
    {
        var result = await students.GetAsync(id);
        if (result is null)
        {
            return NotFound();
        }

        return Ok(result);
    }

    [HttpPost]
    public async Task<ActionResult<StudentSummaryDto>> Post(StudentCreateDto dto)
    {
        var created = await students.CreateAsync(dto);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<StudentSummaryDto>> Put(Guid id, StudentUpdateDto dto)
    {
        var updated = await students.UpdateAsync(id, dto);
        if (updated is null)
        {
            return NotFound();
        }

        return Ok(updated);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var removed = await students.DeleteAsync(id);
        return removed ? NoContent() : NotFound();
    }
}
