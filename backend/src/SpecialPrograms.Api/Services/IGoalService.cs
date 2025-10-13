using SpecialPrograms.Api.Dtos;

namespace SpecialPrograms.Api.Services;

public interface IGoalService
{
    Task<GoalDto> CreateAsync(GoalCreateDto dto);
    Task<GoalDto?> GetAsync(Guid goalId);
    Task<IEnumerable<GoalDto>> GetForStudentAsync(Guid studentId);
    Task<GoalDto?> UpdateAsync(Guid goalId, GoalUpdateDto dto);
    Task<bool> UpdateStatusAsync(Guid goalId, string status);
    Task<bool> DeleteAsync(Guid goalId);
}
