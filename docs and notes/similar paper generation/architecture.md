# The Idea
I want the ability to generate similar papers based on a paper or a set of papers. This is ideally going to be a two-phase process, with two separate agents involved in the process (one in each phase) for obtaining the best results. In Phase 1, the LLM will be instructed to comprehensively analyze the given paper. In Phase 2, via a separate request altogether, the LLM will be asked to make the paper as per the analysis and specifications returned from the model in Phase 1.

---

# PHASE 1 - Comprehensive Analysis 
The entire test JSON is sent to the LLM, along with a prompt dedicated especially for this purpose. The agent must comprehensively analyze the paper pattern, the paper pattern in this case, being the overarching pattern or the style of the questions themselves, and return a blueprint for paper generation with this analysis.

The LLM must analyze and determine- What is the style in which the questions are written? Why are the questions designed in such a manner, and what is the objective of the paper-setter here? What ability of the students is intended to be tested here? Are these questions/is the paper setter trying to test the recall of a student? The depth of their conceptual understanding? Their grasp of basic concepts? Or multiple various facets of learning at once, with different questions being dedicated to different purposes? How deeply is this knowledge/ability being tested? Are the questions based on direct-application of learned concepts, or moderate/deep understanding? 

These deeper patterns, analyzing the structure of the questions themselves, the manner in which they are written, "why" behind the paper and "whom" it's for, these are the patterns that the LLM must unearth and determine. 

Along with this, it should also comprehensively describe the writing style of the questions themselves- Are they straight to the point? Are they describing elaborate scenarios? etc. 

---

# PHASE 2 - Execution and Paper Generation 
Based on the comprehensive analysis of a paper returned from an agent, this phase would be relatively simpler. In this phase the analysis would be sent to another agent which would create a paper with as many questions as chosen by the user, along with any custom instructions that the user may have. 

---

This biphasic architecture of the test generation system would ultimately help instigate deeper investigation into the paper, allowing for better results, and given that the execution agent is different from the analysis agent, it would prevent questions with the same exact template being generated, just with different data. Something nobody wants.

## The runtime structure
The runtime structure is therefore, conceptually -
```
SYSTEM / MAIN PROMPT
        +
USER INSTRUCTIONS
        +
PHASE 1 BLUEPRINT
        ↓
     PHASE 2
        ↓
   GENERATED PAPER
```


And the user's custom instructions go *after* the blueprint rather than before it, like so -
```
[Main execution instructions]

[Paper Blueprint]
...

[User's generation request]
Generate 25 questions...
```

