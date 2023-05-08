@echo off
title EliteElixir // created by ussr (discord id: 952069372069937172)
if not exist "./authCache/" cmd /c md authCache
if not exist package-lock.json cmd /c npm i
:l
node .
goto :l