$ErrorActionPreference = 'Stop'
$mainSource = 'c:\Users\pedro\OneDrive\Desktop\Nova pasta (2)'
$extraSource = 'c:\Users\pedro\OneDrive\Desktop\PN IMAGENS'
$dest = Join-Path $PSScriptRoot 'images\gallery'
$ffmpeg = Join-Path $PSScriptRoot 'tools\ffmpeg\ffmpeg.exe'
$maxWidth = 2800
$quality = 95

if (-not (Test-Path $dest)) {
    New-Item -ItemType Directory -Path $dest -Force | Out-Null
}

Add-Type -AssemblyName System.Drawing

function Apply-ExifOrientation($image) {
    if (-not ($image.PropertyIdList -contains 274)) {
        return $image
    }

    $orientation = $image.GetPropertyItem(274).Value[0]
    switch ($orientation) {
        2 { $image.RotateFlip([System.Drawing.RotateFlipType]::RotateNoneFlipX) }
        3 { $image.RotateFlip([System.Drawing.RotateFlipType]::Rotate180FlipNone) }
        4 { $image.RotateFlip([System.Drawing.RotateFlipType]::Rotate180FlipX) }
        5 { $image.RotateFlip([System.Drawing.RotateFlipType]::Rotate90FlipX) }
        6 { $image.RotateFlip([System.Drawing.RotateFlipType]::Rotate90FlipNone) }
        7 { $image.RotateFlip([System.Drawing.RotateFlipType]::Rotate270FlipX) }
        8 { $image.RotateFlip([System.Drawing.RotateFlipType]::Rotate270FlipNone) }
    }

    return $image
}

function Save-Jpeg($bitmap, $outputPath, $jpegQuality) {
    $encoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
        Where-Object { $_.MimeType -eq 'image/jpeg' } |
        Select-Object -First 1
    $encoderParams = New-Object System.Drawing.Imaging.EncoderParameters 1
    $encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter (
        [System.Drawing.Imaging.Encoder]::Quality,
        [long]$jpegQuality
    )
    $bitmap.Save($outputPath, $encoder, $encoderParams)
}

function Convert-RasterToJpeg($inputPath, $outputPath, $maxW, $jpegQuality) {
    $img = [System.Drawing.Image]::FromFile($inputPath)
    try {
        $null = Apply-ExifOrientation $img

        $width = $img.Width
        $height = $img.Height
        if ($width -gt $maxW) {
            $height = [int][Math]::Round($height * ($maxW / [double]$width))
            $width = $maxW
        }

        $bmp = New-Object System.Drawing.Bitmap $width, $height
        $bmp.SetResolution(72, 72)
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        try {
            $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
            $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
            $g.DrawImage($img, 0, 0, $width, $height)
        }
        finally {
            $g.Dispose()
        }

        Save-Jpeg $bmp $outputPath $jpegQuality
        $bmp.Dispose()
    }
    finally {
        $img.Dispose()
    }
}

function Convert-HeicToJpeg($inputPath, $outputPath, $maxW, $jpegQuality) {
    if (-not (Test-Path $ffmpeg)) {
        throw "ffmpeg nao encontrado em $ffmpeg"
    }

    $tempFile = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), [Guid]::NewGuid().ToString('N') + '.jpg')
    try {
        $null = & $ffmpeg -y -hide_banner -loglevel error -i $inputPath -frames:v 1 -update 1 -q:v 2 $tempFile 2>&1
        if (-not (Test-Path $tempFile)) {
            throw 'ffmpeg nao gerou ficheiro de saida'
        }
        Convert-RasterToJpeg $tempFile $outputPath $maxW $jpegQuality
    }
    finally {
        if (Test-Path $tempFile) {
            Remove-Item $tempFile -Force
        }
    }
}

function Convert-Folder($folder, $prefix) {
    $index = 1
    Get-ChildItem -Path $folder -File | Sort-Object Name | ForEach-Object {
        $ext = $_.Extension.ToLowerInvariant()
        if ($ext -notin '.heic', '.jpg', '.jpeg', '.png') {
            return
        }

        $outputName = ('{0}-{1:D2}.jpg' -f $prefix, $index)
        $outputPath = Join-Path $dest $outputName

        try {
            if ($ext -eq '.heic') {
                Convert-HeicToJpeg $_.FullName $outputPath $maxWidth $quality
            }
            else {
                Convert-RasterToJpeg $_.FullName $outputPath $maxWidth $quality
            }

            $size = (Get-Item $outputPath).Length
            Write-Host ('OK  {0} -> {1} ({2} KB)' -f $_.Name, $outputName, [math]::Round($size / 1KB))
            $index++
        }
        catch {
            Write-Warning ('FAIL {0}: {1}' -f $_.Name, $_.Exception.Message)
        }
    }
    return $index - 1
}

Get-ChildItem -Path $dest -Filter '*.jpg' | Remove-Item -Force

Write-Host 'Principais (Nova pasta 2):'
$mainCount = Convert-Folder $mainSource 'principal'
Write-Host ''
Write-Host 'Restantes (PN IMAGENS):'
$extraCount = Convert-Folder $extraSource 'evento'
Write-Host ''
Write-Host ('Total: {0} principais + {1} extra = {2} imagens' -f $mainCount, $extraCount, ($mainCount + $extraCount))
