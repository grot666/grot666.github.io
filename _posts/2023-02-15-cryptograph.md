---
layout: post
title: Cryptographic 101   
author: yucheng YAN
tags: ["Cryptograph","learning","python"]
---    

### Cryptographic 101
for a developer following keywords are important for you to understand cryptographic.
### hash function. 哈希函数
- 一个输入对应一个输出
- 不能从输出反推输入
- 不能两个输入对应一个输出
- 不能修改输入得到相同的输出

#### 用途
- 用于校验完整性
- 用于保存密码
- 用于生成ID 和随机数

#### 常见的哈希函数
- MD5
- SHA1
- SHA256
- SHA512
- RIPEMD160

#### 算法实现
```python
import hashlib
m = hashlib.md5()
m.update(b"Nobody inspects")
m.update(b" the spammish repetition")
m.digest()
m.hexdigest()
```

### MAC Codes. 消息认证码
  


