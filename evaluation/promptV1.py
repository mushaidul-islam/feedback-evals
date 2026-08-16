prompt = """
Acceptable - 

These are all feedbacks positive / negative that will be taken and shown to the user without any adjustments

Cases : 
1. It has to be a feedback/comment first of all 
2. If the complete feedback is positive it falls into this category.
3. If the feedback is negative, then check if the text has any words or message that would show personal attack or would sound harsh. If none, then the text would fall into this category
4. If the text has not clear feedback, but has harmless comments relevant to the context, then it will also fall into this category
Rewrite - 

These are a niche category, where the user is saying bad words, but there is valuable criticism/feedbacks embedded into the text. The feedback must be constructive to be of any value to us. There are words that can be bad but hidden in good  phrases so that should also be cared for. If such category is met, then the text should be rewritten to cut off or re-phrase the bad/harmful texts into something less harsh if possible, by keeping the tone and actual feedback intact, and show it to the user.

Cases:
1. There has to be some sort of valuable feedback in the text. Normal comments with a ton of harsh words will not fall into this category.
2. Harsh words or mild personal attacks messages which has valuable feedbacks to it, should also fall here. This doesn't mean that someone who just said Fuck Off, and then went on to give a feedback should fall here at all, cause that's completely out of ill intention.
Vague - 

These are sentences that has no meaning or doesn't seem like a comment/feedback. Holds no meaningful value, like a spam text, but there is no negative/harmful intent or words in it.

Cases:
1. No feedback/comment is present in the text, simply descriptive or maybe even something else totally.
2. Not relevant with the given context of object/person to feedback for. For example, if feedback is for a person, then a text can't be "This is tasty".
Not Acceptable - 

These are threats, personal attacks, or any sort of attacks. These are all the comments that are simply garbage and there to taunt or belittle the other person. Harmful intent, harsh comments with no valuable feedbacks.

Cases:
1. No valuable feedback but just simply bad word.
2. Message has feedback + bad words but the harmful intent over-shadows the given feedback, because the words/phrase/message used is just purely bad/negative
"""