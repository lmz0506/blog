# 修复 Kramdown 不支持引用块中嵌套代码块的问题
# 在 Jekyll 转换前预处理 markdown 内容

Jekyll::Hooks.register [:documents, :pages], :pre_render do |document|
  # 只处理 markdown 文档
  if document.extname == '.md' || document.path&.end_with?('.md')
    content = document.content

    # 处理引用块后紧跟的代码块
    # 模式匹配: > 开头的行(包括只有>的空行),然后可能有0-1个空行,然后是 ```
    # 需要确保引用块和代码块之间至少有2个换行符(即1个空行)
    fixed_content = content.gsub(/^((?:>.*\n)+)\n?(```[\w]*\n.*?```$)/m) do
      blockquote_lines = $1
      code_block = $2

      # 移除blockquote末尾可能的多余换行
      blockquote_lines = blockquote_lines.rstrip + "\n"

      # 确保引用块和代码块之间有2个换行符(1个空行)
      "#{blockquote_lines}\n#{code_block}"
    end

    document.content = fixed_content
  end
end
