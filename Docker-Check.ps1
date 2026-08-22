Write-Host "`nNAME                   IMAGE                SERVICE    STATUS"; docker compose ps --format "{{.Name}}|{{.Image}}|{{.Service}}|{{.Status}}" | ForEach-Object { $p=$_ -split '\|'; "{0,-22} {1,-20} {2,-10} {3}" -f $p[0],$p[1],$p[2],$p[3]; Write-Host "" }

Read-Host