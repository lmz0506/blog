---
layout: doc
title: 通义千问-14B-Chat fastchat+vllm部署
category: AI相关
date: '2026-02-27'
tags: []
---
## 通义千问-14B-Chat fastchat+vllm部署
### 环境安装
`演示使用cunda11.8 python3.9`

FastChat文档地址：[https://github.com/lm-sys/FastChat](https://github.com/lm-sys/FastChat)

1. 基础环境安装

> conda create -n qwen2 python==3.9
>
> conda activate qwen2
>



2. 安装与cuda版本相同的pytorch

> + 查看确认系统cuda版本：nvcc -V
> + 安装与系统对应的torch版本：
>

```bash
pip install torch==2.1.2 torchvision==0.16.2 torchaudio==2.1.2 --index-url https://download.pytorch.org/whl/cu118
安装完成后：确认gpu是否开启以及cuda版本,执行一下4个命令
> python
> import torch
> torch.cuda.is_available()
> print(torch.version.cuda)
> ```

```bash
## Re-install xFormers with CUDA 11.8.
$ pip uninstall xformers -y
$ pip install --upgrade xformers --index-url https://download.pytorch.org/whl/cu118
```



3. 安装 vllm-gptq

> (1). 克隆源码
>
> 
>
> (2). 安装源码
>
> 
>
> (3). 如果出现版本不匹配，安装报错
>
> `修改 vllm-gptq的setup.py将 12.1 替换为 11.8`
>
> (4) 重新安装源码
>
> + 删除 requirements.txt 中的 torch 依赖
> + 删除 pyproject.toml 文件
> + 安装：pip install -e .
>

```bash
git clone https://github.com/QwenLM/vllm-gptq.git
```

```bash
cd vllm-gptq

pip install packaging

pip install -e .

```

```bash
RuntimeError: The NVIDIA driver on your system is too old (found version 11080). Please update your GPU driver by downloading and installing a new version from the URL: http://www.nvidia.com/Download/index.aspx Alternatively, go to: https://pytorch.org to install a PyTorch version that has been compiled with your version of the CUDA driver.
     [end of output]

 note: This error originates from a subprocess, and is likely not a problem with pip.
error: subprocess-exited-with-error

× Getting requirements to build editable did not run successfully.
│ exit code: 1
╰─> See above for output.

note: This error originates from a subprocess, and is likely not a problem with pip.

```

```bash
grep 12.1 setup.py
sed -i s/12.1/11.8/g setup.py
grep 11.8 setup.py
```



### 启动 Qwen-14B-Chat
1. 启动前 请安装FastChat

> pip install "fschat[model_worker,webui]"
>



2. 首先利用FastChat启动一个controller

> 创建一个新的窗口：screen -S qw-controller
>
> 环境切换：conda activate qwen2
>
> 创建controller：python -m fastchat.serve.controller --host 0.0.0.0
>
> 可以看到以下信息：
>
> 
>

```bash
(qwen2) chongqing@sunsharing:~$ python -m fastchat.serve.controller --host 0.0.0.0
2024-02-07 09:30:36 | INFO | controller | args: Namespace(host='0.0.0.0', port=21001, dispatch_method='shortest_queue', ssl=False)
| --- | --- | --- | --- |
2024-02-07 09:30:36 | ERROR | stderr | INFO:     Started server process [3435893]
2024-02-07 09:30:36 | ERROR | stderr | INFO:     Waiting for application startup.
2024-02-07 09:30:36 | ERROR | stderr | INFO:     Application startup complete.
2024-02-07 09:30:36 | ERROR | stderr | INFO:     Uvicorn running on http://0.0.0.0:21001 (Press CTRL+C to quit)
```



3. 启动model worker读取模型

> 创建一个新的窗口：screen -S qw-model
>
> 环境切换：conda activate qwen2
>
> 创建worker:
>
> --flot16 双卡(--tensor-parallel-size 2)  
> python -m fastchat.serve.vllm_worker --model-path /home/chongqing/.cache/modelscope/hub/qwen/Qwen-14B-Chat --trust-remote-code --dtype bfloat16 --host 0.0.0.0 --tensor-parallel-size 2  
> --int4 目前只能一张卡，不清楚原因  
> python -m fastchat.serve.vllm_worker --model-path /model/chongqing/qwen/Qwen-14B-Chat-Int4 --trust-remote-code --dtype float16 --host 0.0.0.0 --tensor-parallel-size 1
>
> 指定gpu显卡运行：CUDA_VISIBLE_DEVICES=0 python -m fastchat.serve.vllm_worker --model-path /model/chongqing/qwen/Qwen-14B-Chat-Int4 --trust-remote-code --dtype float16 --host 0.0.0.0 --tensor-parallel-size 1
>
> 可以看到以下信息：
>
> controller 会收到模型的注册信息：
>
> 
>

```bash
(qwen2) chongqing@sunsharing:~$ python -m fastchat.serve.vllm_worker --model-path /model/chongqing/qwen/Qwen-14B-Chat-Int4 --trust-remote-code --dtype float16 --host 0.0.0.0 --tensor-parallel-size 1
/home/chongqing/anaconda3/envs/qwen2/lib/python3.9/site-packages/transformers/utils/generic.py:311: UserWarning: torch.utils._pytree._register_pytree_node is deprecated. Please use torch.utils._pytree.register_pytree_node instead.
 torch.utils._pytree._register_pytree_node(
/home/chongqing/anaconda3/envs/qwen2/lib/python3.9/site-packages/transformers/utils/generic.py:311: UserWarning: torch.utils._pytree._register_pytree_node is deprecated. Please use torch.utils._pytree.register_pytree_node instead.
 torch.utils._pytree._register_pytree_node(
WARNING 02-07 09:33:22 config.py:140] gptq quantization is not fully optimized yet. The speed can be slower than non-quantized models.
INFO 02-07 09:33:22 llm_engine.py:72] Initializing an LLM engine with config: model='/model/chongqing/qwen/Qwen-14B-Chat-Int4', tokenizer='/model/chongqing/qwen/Qwen-14B-Chat-Int4', tokenizer_mode=auto, revision=None, tokenizer_revision=None, trust_remote_code=True, dtype=torch.float16, max_seq_len=2048, download_dir=None, load_format=auto, tensor_parallel_size=1, quantization=gptq, seed=0)
WARNING 02-07 09:33:22 tokenizer.py:66] Using a slow tokenizer. This might cause a significant slowdown. Consider using a fast tokenizer instead.
INFO 02-07 09:34:57 llm_engine.py:219] # GPU blocks: 820, # CPU blocks: 327
2024-02-07 09:34:59 | INFO | model_worker | Loading the model ['Qwen-14B-Chat-Int4'] on worker d2a633f7, worker type: vLLM worker...
| --- | --- | --- | --- |
2024-02-07 09:34:59 | INFO | model_worker | Register to controller
2024-02-07 09:34:59 | ERROR | stderr | INFO:     Started server process [3452371]
2024-02-07 09:34:59 | ERROR | stderr | INFO:     Waiting for application startup.
2024-02-07 09:34:59 | ERROR | stderr | INFO:     Application startup complete.
2024-02-07 09:34:59 | ERROR | stderr | INFO:     Uvicorn running on http://0.0.0.0:21002 (Press CTRL+C to quit)

```

```bash
(qwen2) chongqing@sunsharing:~$ python -m fastchat.serve.controller --host 0.0.0.0
2024-02-07 09:30:36 | INFO | controller | args: Namespace(host='0.0.0.0', port=21001, dispatch_method='shortest_queue', ssl=False)
| --- | --- | --- | --- |
2024-02-07 09:30:36 | ERROR | stderr | INFO:     Started server process [3435893]
2024-02-07 09:30:36 | ERROR | stderr | INFO:     Waiting for application startup.
2024-02-07 09:30:36 | ERROR | stderr | INFO:     Application startup complete.
2024-02-07 09:30:36 | ERROR | stderr | INFO:     Uvicorn running on http://0.0.0.0:21001 (Press CTRL+C to quit)
2024-02-07 09:34:59 | INFO | controller | Register a new worker: http://localhost:21002
2024-02-07 09:34:59 | INFO | controller | Register done: http://localhost:21002, {'model_names': ['Qwen-14B-Chat-Int4'], 'speed': 1, 'queue_length': 0}
2024-02-07 09:34:59 | INFO | stdout | INFO:     127.0.0.1:53346 - "POST /register_worker HTTP/1.1" 200 OK

```



运行时的错误处理

> 如果启动工作节点报错：**CUDA extension not installed**
>
> 将 auto-gptq-0.6.0 替换为 auto-gptq-0.6.0+cu118
>
> `如果重新创建worker还是出现这个错误，手动安装gptq`
>
> 重新启动model worker读取模型
>

```bash
pip install -U auto-gptq --extra-index-url https://huggingface.github.io/autogptq-index/whl/cu118/
```

```bash
下载源码并进入文件夹：git clone https://github.com/PanQiWei/AutoGPTQ.git && cd AutoGPTQ
卸载：pip uninstall autogptq_cuda -y  或者 pip uninstall auto-gptq  -y
重新安装：pip install .

```



4. 启动一个OpenAI的接口服务

> 创建一个新的窗口：screen -S qw-api
>
> 环境切换：conda activate qwen2
>
> 创建api服务: python -m fastchat.serve.openai_api_server --host 0.0.0.0 --port 8000
>
> 可以看到一下信息：
>
> 
>

```bash
(qwen2) chongqing@sunsharing:~$ python -m fastchat.serve.openai_api_server --host 0.0.0.0 --port 8000
2024-02-07 09:38:21 | INFO | openai_api_server | args: Namespace(host='0.0.0.0', port=8000, controller_address='http://localhost:21001', allow_credentials=False, allowed_origins=['*'], allowed_methods=['*'], allowed_headers=['*'], api_keys=None, ssl=False)
| --- | --- | --- | --- |
2024-02-07 09:38:21 | ERROR | stderr | INFO:     Started server process [3465044]
2024-02-07 09:38:21 | ERROR | stderr | INFO:     Waiting for application startup.
2024-02-07 09:38:21 | ERROR | stderr | INFO:     Application startup complete.
2024-02-07 09:38:21 | ERROR | stderr | INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)

```



### 结合langchain的验证
```python
from langchain import PromptTemplate
from langchain.chains import LLMChain
from langchain.chat_models import ChatOpenAI

llm = ChatOpenAI(
    streaming=True,
    verbose=True,
    # callbacks=[callback],
    openai_api_key="none",
    openai_api_base="http://192.168.1.106:8000/v1",
    model_name="Qwen-14B-Chat-Int4"
)

def test():
    # # 提示词
    template = """
    我很想去{location}旅行，我应该在哪里做什么？
    """
    prompt = PromptTemplate(input_variables=["location"],template=template,)
    testchain = LLMChain(llm=llm,prompt=prompt,verbose=True)
    re = testchain.run({"location": "重庆"})
    print(re)


if __name__ == '__main__':
    test()


```

```verilog
> Entering new LLMChain chain...
> Prompt after formatting:

    我很想去重庆旅行，我应该在哪里做什么？
    

> Finished chain.
> 重庆是一个美丽的城市，有许多值得一看的景点。你可以去南山一棵树、解放碑、磁器口古镇游览，也可以去洪崖洞、长江索道、大足石刻游览。此外，你还可以去重庆的夜市品尝美食，去重庆市博物馆欣赏文物，去重庆动物园观赏动物。
> ```





命令参考：

> python -m fastchat.serve.vllm_worker --model-path /model/chongqing/qwen/Qwen-14B-Chat-Int4 --trust-remote-code --dtype bfloat16
>
> # python -m fastchat.serve.vllm_worker --model-path $model_path --trust-remote-code --dtype float16 # 运行int4模型
>
> 
>
> 
>
> pip install torch==2.1.0+cu121 torchvision==0.16.0+cu1218 torchaudio==2.0.1+cu121-f [https://download.pytorch.org/whl/torch_stable.html](https://download.pytorch.org/whl/torch_stable.html)
>
> 
>
> 启动控制层
>
> screen -S qw-controller
>
> conda activate qwen2
>
> screen -r qw-controller
>
> python -m fastchat.serve.controller --host 0.0.0.0
>
> 启动模型
>
> screen -S qw-model
>
> screen -r qw-model 
>
> --flot16 双卡
>
> python -m fastchat.serve.vllm_worker --model-path /home/chongqing/.cache/modelscope/hub/qwen/Qwen-14B-Chat --trust-remote-code --dtype bfloat16 --host 0.0.0.0 --tensor-parallel-size 4
>
> --int4
>
> python -m fastchat.serve.vllm_worker --model-path /model/chongqing/qwen/Qwen-14B-Chat-Int4 --trust-remote-code --dtype float16 --host 0.0.0.0 --tensor-parallel-size 1
>
> 
>
> 启动openApi接口
>
> screen -S qw-api
>
> screen -r qw-api
>
> python -m fastchat.serve.openai_api_server --host 0.0.0.0 --port 8000
>
> 
>
> 启动web页面
>
> screen -S qw-web
>
> python -m fastchat.serve.gradio_web_server --host 0.0.0.0 --port 9997
>
> 
>
> 
>
> curl [http://localhost:8000/v1/embeddings](http://localhost:8000/v1/embeddings) \
>
>  -H "Content-Type: application/json" \
>
>  -d '{
>
>   "input": "Your text string goes here",
>
>   "model": "Qwen-14B-Chat-Int4"
>
> }'
>
> 
>
> 
>
> 
>
> 启动embedding模型接口
>
> python -m fastchat.serve.model_worker --model-names m3e --model-path /model/chongqing/m3e-base --host 0.0.0.0 --dtype bfloat16 --device cpu
>



参考文档：[https://blog.csdn.net/huiguo_/article/details/135766850](https://blog.csdn.net/huiguo_/article/details/135766850)

[https://zhuanlan.zhihu.com/p/675347077](https://zhuanlan.zhihu.com/p/675347077)

