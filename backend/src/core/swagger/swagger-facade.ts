import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiBody, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { extractModule } from '../utils/utils';

export class SwaggerFacade {
  // Facade for Create Operation
  static createOperation(summary: string, dto: any) {
    const moduleType = extractModule(summary);

    return applyDecorators(
      ApiOperation({ summary }),
      ApiBody({ type: dto }),
      ApiResponse({
        status: 201,
        description: `${moduleType} created successfully.`,
      }),
      ApiResponse({ status: 400, description: 'Invalid input.' }),
      ApiResponse({ status: 500, description: 'Internal server error.' })
    );
  }

  // Facade for Update Operation
  static updateOperation(summary: string, dto: any, paramName: string) {
    const moduleType = extractModule(summary);

    return applyDecorators(
      ApiOperation({ summary }),
      ApiParam({ name: paramName, description: `${moduleType} ID` }),
      ApiBody({ type: dto }),
      ApiResponse({
        status: 200,
        description: `${moduleType} updated successfully.`,
      }),
      ApiResponse({ status: 404, description: `${moduleType} not found.` }),
      ApiResponse({ status: 500, description: 'Internal server error.' })
    );
  }

  // Facade for Get by ID Operation
  static getByIdOperation(summary: string, paramName: string) {
    const moduleType = extractModule(summary);

    return applyDecorators(
      ApiOperation({ summary }),
      ApiParam({ name: paramName, description: `${moduleType} ID` }),
      ApiResponse({
        status: 200,
        description: `${moduleType} details fetched successfully.`,
      }),
      ApiResponse({ status: 404, description: `${moduleType} not found.` }),
      ApiResponse({ status: 500, description: 'Internal server error.' })
    );
  }

  // Facade for Delete Operation
  static deleteOperation(summary: string, paramName: string) {
    const moduleType = extractModule(summary);

    return applyDecorators(
      ApiOperation({ summary }),
      ApiParam({ name: paramName, description: `${moduleType} ID` }),
      ApiResponse({
        status: 200,
        description: `${moduleType} deleted successfully.`,
      }),
      ApiResponse({ status: 404, description: `${moduleType} not found.` }),
      ApiResponse({ status: 500, description: 'Internal server error.' })
    );
  }

  // Facade for Get All Operation
  static getAllOperation(summary: string) {
    const moduleType = extractModule(summary);

    return applyDecorators(
      ApiOperation({ summary }),
      ApiResponse({
        status: 200,
        description: `List of ${moduleType}s fetched successfully.`,
      }),
      ApiResponse({ status: 500, description: 'Internal server error.' })
    );
  }
}
