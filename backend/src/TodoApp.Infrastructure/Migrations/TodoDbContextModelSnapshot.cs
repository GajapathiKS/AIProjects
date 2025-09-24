using System;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using TodoApp.Infrastructure.Persistence;

#nullable disable

namespace TodoApp.Infrastructure.Migrations
{
    [DbContext(typeof(TodoDbContext))]
    partial class TodoDbContextModelSnapshot : ModelSnapshot
    {
        protected override void BuildModel(ModelBuilder modelBuilder)
        {
#pragma warning disable 612, 618
            modelBuilder
                .HasAnnotation("ProductVersion", "8.0.0")
                .HasAnnotation("Relational:MaxIdentifierLength", 63);

            modelBuilder.Entity("TodoApp.Domain.Entities.TodoItem", b =>
            {
                b.Property<Guid>("Id")
                    .HasColumnType("uuid");

                b.Property<bool>("IsCompleted")
                    .HasColumnType("boolean");

                b.Property<string>("Title")
                    .HasMaxLength(200)
                    .HasColumnType("character varying(200)");

                b.HasKey("Id");

                b.ToTable("TodoItems");
            });
#pragma warning restore 612, 618
        }
    }
}
