package gal.usc.telariabackend.model.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Setter
@Getter
public class AiChatMessageRequest {
    @NotBlank
    private String content;

}
