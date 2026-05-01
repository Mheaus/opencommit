import axios, { AxiosInstance } from 'axios';
import { OpenAI } from 'openai';
import { normalizeEngineError } from '../utils/engineErrorHandler';
import { removeContentTags } from '../utils/removeContentTags';
import { AiEngine, AiEngineConfig } from './Engine';

interface OllamaConfig extends AiEngineConfig {}

export class OllamaEngine implements AiEngine {
  config: OllamaConfig;
  client: AxiosInstance;

  constructor(config) {
    this.config = config;

    const baseURL = config.baseURL || 'http://localhost:11434';

    this.client = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
        ...config.customHeaders
      }
    });
  }

  async generateCommitMessage(
    messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam>
  ): Promise<string | undefined> {
    const params = {
      model: this.config.model ?? 'mistral',
      messages,
      options: { temperature: 0, top_p: 0.1 },
      stream: false
    };
    try {
      const response = await this.client.post('/api/chat', params);

      const { message } = response.data;
      let content = message?.content;
      return removeContentTags(content, 'think');
    } catch (error) {
      throw normalizeEngineError(error, 'ollama', this.config.model);
    }
  }
}
