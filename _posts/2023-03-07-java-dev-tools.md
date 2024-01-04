---
layout: post
title: note all useful dev tool
author: yucheng YAN
tags: ["java","dev","tools"]
---    
<!-- checkbox -->
## java dev tools
checklist for java dev tools

1. [x]  SDKman 
2. [ ] spring-boot CLI 
3. [ ] Intellij IDEA 
4. [ ] DB-related 


## SDKman  
install sdk and base commands  
[Offical SDKman Site](https://sdkman.io/)   
### **installation** 
```
curl -s "https://get.sdkman.io" | bash
```   
Download SDKman  
```
source "$HOME/.sdkman/bin/sdkman-init.sh"
```  
source this or just oepn a new terminal  
```
sdk version
```  
verify the installation of SDKman  
if everything went well ,would appear  
```
sdkman X.YY.Z
```  
### **base usage**  
- So in my practice i usually List the JDK or SDK i need ,then install 
- or switch  between different versions of Kits  

*Install*  
```
sdk install java 
```  
This Command will install the latest version of JAVA . which you should not do ,java's version is so relevent.  
You can also install a specifque version or a local version .
For example
```
sdk install scala 3.2.2
```  
:shipit:  I ship it  
try list command first  
```
sdk list java 
``` 
or locally  
``` 
sdk install groovy 3.0.0-SNAPSHOT /path/to/groovy-3.0.0-SNAPSHOT 
```  
for other commands  
```
sdk -h
```  
is quite useful  `

## spring-boot CLI  
now ,you got a powerful kit control tool ,try to install spring-boot cli using it .which called spring.  






