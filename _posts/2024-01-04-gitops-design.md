---
layout: post
title: my gitops design plan
author: yucheng YAN
tags: ["GitOps","DevOps"]
---  

## gitops design plan

### TL;DR
what is gitops?
> GitOps is a way to do Kubernetes cluster management and application delivery. It works by using Git as a single source of truth for declarative infrastructure and applications. With Git at the center of your delivery pipelines, developers can make pull requests to accelerate and simplify application deployments and operations tasks to Kubernetes.
> it's also a way to manage infrastucture as code(IAC),where all changes to the system are made through Git commits and pull requests,so that the entire system can be versioned and audited.
---  
  
### Background  
what we have currently and what we want to achieve?
-  OKD(Openshift) cluster as test and dev environments  
-  k8s cluster as production environment and staging environment  
-  github as code repository  
-  github action is used to build and deploy   application   
-  jfrog is used to store docker images  
-  manifests are stored in github repository  
-  other tools 


### Design
-  use argocd as gitops tool to manage k8s cluster
-  use github action to build and push docker images to jfrog

### Steps and details 
applications  

@todo



