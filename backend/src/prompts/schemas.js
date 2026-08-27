/**
 * Tool schemas for Anthropic Claude Function Calling.
 */

export const TOOL_DEFINITIONS = [
  {
    name: 'getUserApplications',
    description: 'Fetch the authenticated user\'s saved job applications',
    input_schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['SAVED', 'APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'REJECTED'],
          description: 'Filter applications by status'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of records to return'
        }
      }
    }
  },
  {
    name: 'getApplicationDetails',
    description: 'Get full details and status history for a specific application ID',
    input_schema: {
      type: 'object',
      properties: {
        applicationId: {
          type: 'number',
          description: 'The numeric PostgreSQL application ID'
        }
      },
      required: ['applicationId']
    }
  },
  {
    name: 'getResumeAnalysis',
    description: 'Fetch a previously saved resume analysis result by MongoDB ID',
    input_schema: {
      type: 'object',
      properties: {
        analysisId: {
          type: 'string',
          description: 'The MongoDB ObjectId string of the analysis'
        }
      },
      required: ['analysisId']
    }
  },
  {
    name: 'calculateSkillGap',
    description: 'Calculate skill gaps between user skills and job requirements for an application',
    input_schema: {
      type: 'object',
      properties: {
        applicationId: {
          type: 'number',
          description: 'The numeric PostgreSQL application ID'
        }
      },
      required: ['applicationId']
    }
  },
  {
    name: 'saveInterviewResult',
    description: 'Persist evaluation results for an interview question session',
    input_schema: {
      type: 'object',
      properties: {
        sessionId: { type: 'number' },
        score: { type: 'number' },
        feedback: { type: 'string' }
      },
      required: ['sessionId', 'score', 'feedback']
    }
  }
];
