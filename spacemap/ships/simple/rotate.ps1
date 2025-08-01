Add-Type -AssemblyName System.Drawing

$scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Definition

$pngFiles = Get-ChildItem -Path $scriptDirectory -Recurse -Filter *.png

foreach ($file in $pngFiles) {
    $image = [System.Drawing.Image]::FromFile($file.FullName)

    $image.RotateFlip([System.Drawing.RotateFlipType]::Rotate270FlipNone)

    $image.Save($file.FullName)

    $image.Dispose()
}