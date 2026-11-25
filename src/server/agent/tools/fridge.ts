import { z } from "zod";
import { idSchema, leftoverEatSchema, leftoverInputSchema, leftoverUpdateSchema } from "@shared/schemas";
import { addLeftover, eatLeftover, listFridge, updateLeftover } from "../../services/fridge/leftovers";
import { define } from "./define";

export const fridgeTools = [
  define(
    "list_fridge",
    "Les restes au frigo, du plus ancien au plus récent : nom, jour où ils ont été cuisinés (createdOn), âge en jours, parts restantes. À regarder en premier quand on demande quoi manger.",
    z.object({}),
    () => listFridge(),
  ),
  define(
    "add_leftover",
    "Ajoute un reste au frigo à la main : un repas de la bibliothèque (mealId) ou un nom libre (name), avec le nombre de parts et le jour où il a été cuisiné (aujourd'hui par défaut). Les parts gardées d'un repas planifié (keep dans set_slot) y sont déjà.",
    leftoverInputSchema,
    addLeftover,
  ),
  define(
    "update_leftover",
    "Corrige les parts restantes d'un reste (remaining), ou le sort du frigo : done = eaten (fini) ou thrown (jeté).",
    z.object({ id: idSchema, ...leftoverUpdateSchema.shape }),
    ({ id, ...patch }) => updateLeftover(id, patch),
  ),
  define(
    "eat_leftover",
    "Place un reste sur un créneau du planning (« Restes · … ») : les parts du créneau sont retirées du reste, rien n'est ajouté aux courses. Les repas déjà sur le créneau restent.",
    z.object({ id: idSchema, ...leftoverEatSchema.shape }),
    ({ id, ...at }) => eatLeftover(id, at),
  ),
];
