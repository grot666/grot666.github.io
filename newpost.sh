#!/bin/bash

# Check if post title was provided
if [ -z "$1" ]
then
    echo "Please provide a post title"
    exit 1
fi

# Get current date
DATE=$(date +"%Y-%m-%d")

# Post title
TITLE="$1"

# Filename
FILENAME="_posts/$DATE-$TITLE.md"

# Front matter
cat << EOF > $FILENAME
---
layout: post
title:  "$TITLE"
date:   $DATE
categories: jekyll update
---
EOF

# Open the file with Visual Studio Code
code $FILENAME