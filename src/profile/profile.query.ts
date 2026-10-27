// A working first operation for visitors opening the public Apollo Sandbox.
export const BUSINESS_CARD_QUERY = `query BusinessCard {
  profile {
    name
    description
    links { label url }
    skills { name }
    experience { company position startDate endDate achievements }
    projects { name description url }
  }
}`;
