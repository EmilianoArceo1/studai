import { IdeaType } from "../enums/IdeaType";
import { IdeaOrigin } from "../enums/IdeaOrigin";
import { IdeaStatus } from "../enums/IdeaStatus";

export interface Idea {
  ideaId: string;
  projectId: string;

  sourceId?: string;
  anchorId?: string;

  type: IdeaType;
  rephrase: string;

  origin: IdeaOrigin;
  status: IdeaStatus;

  confidence: number;

  createdAt: string;
  updatedAt: string;

   hiddenFromNotes?: boolean;
}
