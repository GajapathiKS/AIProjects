using System;
using BCrypt.Net;

if (args.Length == 0)
{
    Console.WriteLine("Usage: PasswordHashGen <password>");
    return;
}

var password = args[0];
var hash = BCrypt.Net.BCrypt.HashPassword(password);
Console.WriteLine(hash);
