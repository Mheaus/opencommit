import cl100k_base from '@dqbd/tiktoken/encoders/cl100k_base.json';
import { Tiktoken } from '@dqbd/tiktoken/lite';

let _encoding: Tiktoken | null = null;

function getEncoding(): Tiktoken {
  if (!_encoding) {
    _encoding = new Tiktoken(
      cl100k_base.bpe_ranks,
      cl100k_base.special_tokens,
      cl100k_base.pat_str
    );
  }
  return _encoding;
}

export function tokenCount(content: string): number {
  const encoding = getEncoding();
  const tokens = encoding.encode(content);
  return tokens.length;
}
