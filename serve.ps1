$port = 8080
$root = $PSScriptRoot
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()

Write-Host ""
Write-Host "Ponto Nobre - servidor local" -ForegroundColor Green
Write-Host "Abra no browser: http://localhost:$port/" -ForegroundColor Cyan
Write-Host "Pressione Ctrl+C para parar." -ForegroundColor DarkGray
Write-Host ""

$mime = @{
    '.html' = 'text/html; charset=utf-8'
    '.css'  = 'text/css; charset=utf-8'
    '.js'   = 'application/javascript; charset=utf-8'
    '.png'  = 'image/png'
    '.jpg'  = 'image/jpeg'
    '.jpeg' = 'image/jpeg'
    '.webp' = 'image/webp'
    '.svg'  = 'image/svg+xml'
    '.ico'  = 'image/x-icon'
}

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $path = $request.Url.LocalPath.TrimStart('/')
        if ([string]::IsNullOrWhiteSpace($path)) { $path = 'index.html' }

        $file = Join-Path $root ($path -replace '/', [IO.Path]::DirectorySeparatorChar)
        $file = [IO.Path]::GetFullPath($file)

        if (-not $file.StartsWith([IO.Path]::GetFullPath($root), [StringComparison]::OrdinalIgnoreCase)) {
            $response.StatusCode = 403
            $buffer = [Text.Encoding]::UTF8.GetBytes('403 Forbidden')
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            Write-Host ($request.HttpMethod + ' ' + $request.Url.LocalPath + ' 403')
        }
        elseif (Test-Path $file -PathType Leaf) {
            $ext = [IO.Path]::GetExtension($file).ToLowerInvariant()
            $contentType = $mime[$ext]
            if (-not $contentType) { $contentType = 'application/octet-stream' }

            $bytes = [IO.File]::ReadAllBytes($file)
            $response.ContentType = $contentType
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            Write-Host ($request.HttpMethod + ' ' + $request.Url.LocalPath + ' 200')
        }
        else {
            $response.StatusCode = 404
            $buffer = [Text.Encoding]::UTF8.GetBytes('404 Not Found')
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            Write-Host ($request.HttpMethod + ' ' + $request.Url.LocalPath + ' 404')
        }

        $response.Close()
    }
}
finally {
    $listener.Stop()
    $listener.Close()
}
