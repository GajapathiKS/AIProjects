using SpecialPrograms.Api.Dtos;

namespace SpecialPrograms.Api.Services;

public interface IProgressService
{
    Task<ProgressUpdateDto> CreateAsync(ProgressUpdateCreateDto dto);
    Task<IEnumerable<ProgressUpdateDto>> GetForGoalAsync(Guid goalId);
    Task<ProgressUpdateDto?> UpdateAsync(Guid progressId, ProgressUpdateCreateDto dto);
    Task<bool> DeleteAsync(Guid progressId);
}
