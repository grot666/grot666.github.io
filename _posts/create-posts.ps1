# Define the current date and input name
$year = (Get-Date).Year
$month = (Get-Date).Month.ToString("00")
$day = (Get-Date).Day.ToString("00")
$inputName = Read-Host "Enter the post name"

# Construct the file name
$fileName = "$year-$month-$day-$inputName.md"

# Define the content for the new post
$content = @"
---
layout: post
title: "$inputName"
date: $year-$month-$day
categories: []
---
Write your content here.
"@

# Define the path to save the file
$filePath = Join-Path -Path (Get-Location) -ChildPath $fileName

# Create the file with the content
Set-Content -Path $filePath -Value $content

Write-Host "Post created: $filePath"
# Open the newly created file in Visual Studio Code
code $filePath