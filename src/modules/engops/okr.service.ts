import { prisma } from '../../common/prisma';
import {
  CreateObjectiveInput,
  CreateKeyResultInput,
  UpdateKeyResultInput,
} from './engops.types';
import { OkrStatus } from '@prisma/client';

export class OkrService {
  /**
   * Helper to recalculate parent Objective progress percent based on its Key Results
   */
  private static async recalculateObjectiveProgress(objectiveId: string) {
    const keyResults = await prisma.keyResult.findMany({
      where: { objectiveId },
    });

    if (keyResults.length === 0) {
      await prisma.objective.update({
        where: { id: objectiveId },
        data: { progressPercent: 0, status: OkrStatus.ON_TRACK },
      });
      return;
    }

    const totalProgress = keyResults.reduce((sum, kr) => sum + kr.progressPercent, 0);
    const avgProgress = parseFloat((totalProgress / keyResults.length).toFixed(1));

    let status: OkrStatus = OkrStatus.ON_TRACK;
    if (avgProgress >= 100.0) {
      status = OkrStatus.COMPLETED;
    } else if (avgProgress < 40.0) {
      status = OkrStatus.AT_RISK;
    }

    await prisma.objective.update({
      where: { id: objectiveId },
      data: {
        progressPercent: avgProgress,
        status,
      },
    });
  }

  /**
   * List Objectives with their Key Results
   */
  public static async listObjectives(orgId: string, quarter?: string) {
    const where: any = { orgId };
    if (quarter) where.quarter = quarter;

    return prisma.objective.findMany({
      where,
      include: {
        workspace: {
          select: { id: true, name: true, slug: true },
        },
        keyResults: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: [{ level: 'asc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Create an Objective
   */
  public static async createObjective(orgId: string, input: CreateObjectiveInput) {
    return prisma.objective.create({
      data: {
        orgId,
        title: input.title,
        description: input.description || null,
        level: input.level as any,
        quarter: input.quarter,
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
        workspaceId: input.workspaceId || null,
      },
      include: {
        keyResults: true,
      },
    });
  }

  /**
   * Update Objective
   */
  public static async updateObjective(orgId: string, id: string, input: any) {
    return prisma.objective.update({
      where: { id },
      data: {
        title: input.title,
        description: input.description,
        status: input.status,
        quarter: input.quarter,
      },
    });
  }

  /**
   * Delete Objective
   */
  public static async deleteObjective(orgId: string, id: string) {
    return prisma.objective.delete({ where: { id } });
  }

  /**
   * Add a Key Result to an Objective
   */
  public static async createKeyResult(objectiveId: string, input: CreateKeyResultInput) {
    const initialValue = input.initialValue ?? 0;
    const currentValue = input.currentValue ?? 0;
    const range = Math.max(0.001, input.targetValue - initialValue);
    const progress = Math.min(
      100,
      Math.max(0, ((currentValue - initialValue) / range) * 100)
    );

    const kr = await prisma.keyResult.create({
      data: {
        objective: { connect: { id: objectiveId } },
        title: input.title,
        targetValue: input.targetValue,
        currentValue,
        initialValue,
        unit: input.unit || '%',
        ownerName: input.ownerName || null,
        progressPercent: parseFloat(progress.toFixed(1)),
        status: progress >= 100 ? OkrStatus.COMPLETED : OkrStatus.ON_TRACK,
      },
    });

    await this.recalculateObjectiveProgress(objectiveId);
    return kr;
  }

  /**
   * Update Key Result progress value
   */
  public static async updateKeyResult(krId: string, input: UpdateKeyResultInput) {
    const kr = await prisma.keyResult.findUnique({ where: { id: krId } });
    if (!kr) throw new Error('Key Result not found');

    const initialValue = kr.initialValue ?? 0;
    const curVal = input.currentValue !== undefined ? input.currentValue : (kr.currentValue ?? 0);
    const range = Math.max(0.001, kr.targetValue - initialValue);
    const progress = Math.min(
      100,
      Math.max(0, ((curVal - initialValue) / range) * 100)
    );

    const updated = await prisma.keyResult.update({
      where: { id: krId },
      data: {
        title: input.title !== undefined ? input.title : kr.title,
        currentValue: curVal,
        progressPercent: parseFloat(progress.toFixed(1)),
        status:
          input.status !== undefined
            ? (input.status as any)
            : progress >= 100
            ? OkrStatus.COMPLETED
            : progress < 30
            ? OkrStatus.AT_RISK
            : OkrStatus.ON_TRACK,
        ownerName: input.ownerName !== undefined ? input.ownerName : kr.ownerName,
      },
    });

    await this.recalculateObjectiveProgress(kr.objectiveId);
    return updated;
  }

  /**
   * Delete Key Result
   */
  public static async deleteKeyResult(krId: string) {
    const kr = await prisma.keyResult.findUnique({ where: { id: krId } });
    if (!kr) throw new Error('Key Result not found');

    await prisma.keyResult.delete({ where: { id: krId } });
    await this.recalculateObjectiveProgress(kr.objectiveId);
  }
}
