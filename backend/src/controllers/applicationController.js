import prisma from '../config/prisma.js';
import { sendSuccess } from '../utils/response.js';
import { NotFoundError } from '../utils/errors.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const createApplication = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { company, jobTitle, jobUrl, notes, currentStatus, jobDescriptionId } = req.body;

  // PRISMA TRANSACTION: Create Application & Initial ApplicationStatusHistory atomically
  const application = await prisma.$transaction(async (tx) => {
    const app = await tx.application.create({
      data: {
        userId,
        jobDescriptionId: jobDescriptionId || null,
        company,
        jobTitle,
        jobUrl: jobUrl || null,
        notes: notes || null,
        currentStatus: currentStatus || 'SAVED',
        appliedAt: currentStatus === 'APPLIED' ? new Date() : null,
        statusHistory: {
          create: [{
            status: currentStatus || 'SAVED',
            notes: notes ? `Initial note: ${notes}` : 'Application record created'
          }]
        }
      },
      include: {
        statusHistory: true,
        jobDescription: true
      }
    });

    return app;
  });

  return sendSuccess(res, { application }, 201, 'Job application created successfully.');
});

export const listApplications = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { status, search } = req.query;

  const where = { userId };
  if (status) {
    where.currentStatus = status;
  }
  if (search) {
    where.OR = [
      { company: { contains: search, mode: 'insensitive' } },
      { jobTitle: { contains: search, mode: 'insensitive' } }
    ];
  }

  const applications = await prisma.application.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      jobDescription: { select: { id: true, title: true, company: true } },
      statusHistory: { orderBy: { createdAt: 'desc' }, take: 1 }
    }
  });

  return sendSuccess(res, { applications });
});

export const getApplicationById = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const id = Number(req.params.id);

  const application = await prisma.application.findFirst({
    where: { id, userId }, // Ownership check
    include: {
      jobDescription: true,
      statusHistory: { orderBy: { createdAt: 'asc' } }
    }
  });

  if (!application) {
    throw new NotFoundError(`Application #${id} not found.`);
  }

  return sendSuccess(res, { application });
});

export const updateApplication = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const id = Number(req.params.id);
  const { company, jobTitle, jobUrl, notes, currentStatus } = req.body;

  // Ownership check
  const existingApp = await prisma.application.findFirst({ where: { id, userId } });
  if (!existingApp) {
    throw new NotFoundError(`Application #${id} not found.`);
  }

  const statusChanged = currentStatus && currentStatus !== existingApp.currentStatus;

  // PRISMA TRANSACTION: Update Application & Add Status History entry atomically if status changed
  const updatedApp = await prisma.$transaction(async (tx) => {
    const updated = await tx.application.update({
      where: { id },
      data: {
        company: company !== undefined ? company : existingApp.company,
        jobTitle: jobTitle !== undefined ? jobTitle : existingApp.jobTitle,
        jobUrl: jobUrl !== undefined ? jobUrl : existingApp.jobUrl,
        notes: notes !== undefined ? notes : existingApp.notes,
        currentStatus: currentStatus !== undefined ? currentStatus : existingApp.currentStatus,
        appliedAt: currentStatus === 'APPLIED' && !existingApp.appliedAt ? new Date() : existingApp.appliedAt
      },
      include: {
        statusHistory: { orderBy: { createdAt: 'desc' } }
      }
    });

    if (statusChanged) {
      await tx.applicationStatusHistory.create({
        data: {
          applicationId: id,
          status: currentStatus,
          notes: notes || `Status updated from ${existingApp.currentStatus} to ${currentStatus}`
        }
      });
    }

    return updated;
  });

  return sendSuccess(res, { application: updatedApp }, 200, 'Application updated successfully.');
});

export const deleteApplication = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const id = Number(req.params.id);

  const existingApp = await prisma.application.findFirst({ where: { id, userId } });
  if (!existingApp) {
    throw new NotFoundError(`Application #${id} not found.`);
  }

  await prisma.application.delete({ where: { id } });

  return sendSuccess(res, { message: 'Application deleted successfully.' });
});
