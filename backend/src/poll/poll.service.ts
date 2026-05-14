import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CreatePollDto } from './dto/create-poll.dto';
import { TCurrentUserType } from '../auth/types/user.type';

@Injectable()
export class PollService {
  private readonly _logger = new Logger(PollService.name);

  constructor(private readonly configService: ConfigService) {}

  private async _request(path: string, method: string = 'GET', body?: any) {
    const ssoUrl = this.configService.get<string>('SSO_URL');
    const apiKey = this.configService.get<string>('ODIN_SERVICE_KEY');

    if (!ssoUrl || !apiKey) {
      this._logger.error('SSO_URL or ODIN_SERVICE_KEY is not defined in environment variables');
      throw new InternalServerErrorException('SSO service configuration is missing');
    }

    const url = `${ssoUrl}${path}`;
    const headers: any = {
      'x-service-key': apiKey,
    };

    this._logger.debug(`Sending ${method} request to ${url}`);
    this._logger.debug(`Headers: ${JSON.stringify({ ...headers, 'x-service-key': '[MASKED]' })}`);

    let fetchOptions: RequestInit = {
      method,
      headers,
    };

    if (body) {
      if (body instanceof FormData) {
        fetchOptions.body = body;
        // fetch will automatically set the correct Content-Type for FormData
      } else {
        headers['Content-Type'] = 'application/json';
        fetchOptions.body = JSON.stringify(body);
      }
    }

    try {
      const response = await fetch(url, fetchOptions);
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        this._logger.error(`SSO API ${method} ${path} failed: ${response.statusText}`, result);
        throw new Error(result.message || `Failed to ${method} ${path} in SSO service`);
      }

      if (result.total !== undefined || result.pageCount !== undefined) {
        return result;
      }
      return result.data || result;
    } catch (error) {
      this._logger.error(`Error connecting to SSO service: ${error.message}`);
      throw error;
    }
  }

  async createPoll(createPollDto: CreatePollDto, user: TCurrentUserType, files?: any[]) {
    const payload: any = {
      ...createPollDto,
      createdBy: {
        userId: user.sub || user._id,
        userName: user.name || user.email,
      },
      updatedBy: {
        userId: user.sub || user._id,
        userName: user.name || user.email,
      },
    };

    if (files && files.length > 0) {
      const formData = new FormData();
      Object.keys(payload).forEach((key) => {
        if (Array.isArray(payload[key])) {
          payload[key].forEach((item) => formData.append(key, item));
        } else if (typeof payload[key] === 'object' && payload[key] !== null) {
          formData.append(key, JSON.stringify(payload[key]));
        } else {
          formData.append(key, payload[key]);
        }
      });

      files.forEach((file) => {
        const blob = new Blob([file.buffer], { type: file.mimetype });
        formData.append('image', blob, file.originalname);
      });

      return this._request('/api/internal/polls', 'POST', formData);
    }

    return this._request('/api/internal/polls', 'POST', payload);
  }

  async findAll(query: any) {
    const queryParams: any = { ...query };
    
    // Map searchTerm to a wildcard search on the 'question' field.
    // This triggers the SSO service's filter() method to perform a regex "contains" search.
    if (queryParams.searchTerm) {
      queryParams.question = `*${queryParams.searchTerm}*`;
    }

    const queryString = new URLSearchParams(queryParams).toString();
    return this._request(`/api/internal/polls?${queryString}`, 'GET');
  }

  async findOne(id: string) {
    return this._request(`/api/internal/polls/${id}`, 'GET');
  }

  async update(id: string, updatePollDto: any, user: TCurrentUserType) {
    const payload = {
      ...updatePollDto,
      updatedBy: {
        userId: user.sub || user._id,
        userName: user.name || user.email,
      },
    };

    return this._request(`/api/internal/polls/${id}`, 'PUT', payload);
  }

  async vote(id: string, voteDto: any) {
    return this._request(`/api/polls/${id}/vote`, 'POST', voteDto);
  }

  async remove(id: string, user: TCurrentUserType) {
    return this._request(`/api/internal/polls/${id}`, 'DELETE');
  }
}