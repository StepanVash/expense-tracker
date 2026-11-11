Set WshShell = CreateObject("WScript.Shell")
scriptDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
WshShell.Run Chr(34) & scriptDir & "\launch.bat" & Chr(34), 0, False
Set WshShell = Nothing

